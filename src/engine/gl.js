// Thin WebGL2 helpers: programs, textures, framebuffers, fullscreen geometry.

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 unavailable');
  const extCBF = gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  gl.__floatOK = !!extCBF;
  gl.__aniso = aniso;
  gl.__maxAniso = aniso ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
  // unit quad (two triangles) for cards, attribute 0 = corner in [0,1]^2
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.__quad = vao;
  return gl;
}

function numbered(src) {
  return src.split('\n').map((l, i) => String(i + 1).padStart(4) + ': ' + l).join('\n');
}

export function compile(gl, vsSrc, fsSrc, label = 'program') {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      // show only the lines around the error for readability
      const m = /ERROR: \d+:(\d+)/.exec(log);
      let ctx = '';
      if (m) {
        const ln = +m[1]; const lines = src.split('\n');
        ctx = lines.slice(Math.max(0, ln - 6), ln + 3).map((l, i) => String(Math.max(1, ln - 5) + i).padStart(4) + ': ' + l).join('\n');
      } else ctx = numbered(src).slice(0, 4000);
      throw new Error(`[${label}] ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader error:\n${log}\n${ctx}`);
    }
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`[${label}] link error: ${gl.getProgramInfoLog(p)}`);
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
  }
  return { prog: p, uniforms, label };
}

// Set uniforms from a plain object. Numbers -> float, arrays by length, {tex} -> sampler.
export function setUniforms(gl, program, values, texUnitStart = 0) {
  let unit = texUnitStart;
  for (const name in values) {
    const u = program.uniforms[name];
    if (!u) continue;
    const v = values[name];
    const T = u.type;
    if (T === gl.SAMPLER_2D) {
      const tex = v && (v.tex || v);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u.loc, unit);
      unit++;
    } else if (T === gl.FLOAT) {
      if (u.size > 1) gl.uniform1fv(u.loc, v); else gl.uniform1f(u.loc, v);
    } else if (T === gl.FLOAT_VEC2) { gl.uniform2fv(u.loc, v); }
    else if (T === gl.FLOAT_VEC3) { gl.uniform3fv(u.loc, v); }
    else if (T === gl.FLOAT_VEC4) { gl.uniform4fv(u.loc, v); }
    else if (T === gl.INT || T === gl.BOOL) { if (u.size > 1) gl.uniform1iv(u.loc, v); else gl.uniform1i(u.loc, v | 0); }
    else if (T === gl.FLOAT_MAT3) { gl.uniformMatrix3fv(u.loc, false, v); }
    else if (T === gl.FLOAT_MAT4) { gl.uniformMatrix4fv(u.loc, false, v); }
  }
  return unit;
}

export function texFromSource(gl, src, { mipmap = true, wrap = 'clamp', premultiply = true } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  configureTex(gl, tex, { mipmap, wrap });
  return tex;
}

export function updateTexFromSource(gl, tex, src, { mipmap = false, premultiply = true } = {}) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  if (mipmap) gl.generateMipmap(gl.TEXTURE_2D);
}

export function configureTex(gl, tex, { mipmap = true, wrap = 'clamp' } = {}) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const w = wrap === 'repeat' ? gl.REPEAT : wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mipmap) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    if (gl.__aniso) gl.texParameterf(gl.TEXTURE_2D, gl.__aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.__maxAniso));
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
}

// Render target. float=true -> RGBA16F (needs EXT_color_buffer_float), else RGBA8.
export function createTarget(gl, w, h, { float = true, mipmap = false } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const useFloat = float && gl.__floatOK;
  if (useFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete ' + st);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h, float: useFloat, mipmap };
}

export function deleteTarget(gl, t) {
  if (!t) return;
  gl.deleteFramebuffer(t.fb);
  gl.deleteTexture(t.tex);
}

export function bindTarget(gl, t) {
  if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); }
  else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); }
}

export function drawQuad(gl) {
  gl.bindVertexArray(gl.__quad);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
