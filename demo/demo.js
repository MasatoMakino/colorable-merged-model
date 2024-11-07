(()=>{"use strict";var e,n={321:(e,n,t)=>{var r=t(75);class i extends r.ZAu{constructor(e){super(),this.getGeometryID=e=>{const n=e.match(/.*_.*_(\d*)/);if(null==n)throw new Error(`Invalid name: ${e}`);return Number(n[1])},null!=e.bodyOption&&(this.body=new o(e.bodyOption),this.add(this.body)),null!=e.edgeOption&&(this.edge=new a(e.edgeOption),this.add(this.edge))}async merge(){await Promise.all([this.body?.geometryMerger.merge(),this.edge?.geometryMerger.merge()])}}i.MODEL_INDEX="MODEL_INDEX";class o extends r.Kj0{constructor(e){super(),this.geometryMerger=new _(this,e)}}class a extends r.ejS{constructor(e){super(),e.edgeDetail=e.edgeDetail??7,this.geometryMerger=new h(this,e)}}var l=t(333),s=t(984),c=t(146);class d extends c.v{constructor(e){super(),this.uniformName=e,this.colors=new Map,l.k7.start()}setMaterial(e){this.material=e}static getColorMapKey(e){return`${e}`}add(e,n){const t=new l.ZM(255*e[0],255*e[1],255*e[2],e[3]);this.colors.set(d.getColorMapKey(n),t),t.on("onUpdate",(()=>{this.updateUniform(t)}))}get(e){return this.colors.get(d.getColorMapKey(e))}getUniformIndex(e){return[...this.colors.keys()].indexOf(d.getColorMapKey(e))}getUniformIndexFromColor(e){return[...this.colors.values()].indexOf(e)}getSize(){return this.colors.size}changeColor(e,n,t){t=t??{},t.now??=performance.now(),t.duration??=1e3,t.easing??=s.oY.Cubic.Out;const r=this.get(n);r?.change(255*e[0],255*e[1],255*e[2],e[3],t.duration,{easing:t.easing,startTime:t.now})}updateUniformsAll(){this.colors.forEach((e=>{this.updateUniform(e)}))}updateUniform(e){if(null==this.material)return;const n=this.material.uniforms[this.uniformName].value;if(null==n)return void console.error(`対象のマテリアルに、${this.uniformName}という名前のuniformが存在しません。${this.material.name}のuniform生成処理にこの名前のuniformを追加してください。`);const t=this.getUniformIndexFromColor(e),r=e.getAttribute();n[t].set(...r)}}class u extends r.jyz{constructor(e,n){if(super(e),this.isColorableMergedMaterial=!0,this.initDefine=e=>{this.defines={INDEX:e}},0===n)throw new Error("ColorableMergedMaterialには少なくとも1つ以上のTweenableColorが必要です。\n        このMaterialに紐づけられたTweenableColoMapには1つもTweenableColorが登録されていません。");this.isColorableMergedMaterial=!0,this.initDefine(n)}static getColorUniform(e){return{colors:{value:new Array(e).fill(0).map((()=>new r.Ltg(1,1,1,.5)))}}}}class g extends u{constructor(e,n){super({vertexShader:"\n#include <common>\n#include <uv_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\nattribute float MODEL_INDEX;\nvarying float colorTableIndex;\n\nvoid main() {\n\n\t#include <uv_vertex>\n\t#include <color_vertex>\n\t#include <morphcolor_vertex>\n\n\t#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )\n\n\t\t#include <beginnormal_vertex>\n\t\t#include <morphnormal_vertex>\n\t\t#include <skinbase_vertex>\n\t\t#include <skinnormal_vertex>\n\t\t#include <defaultnormal_vertex>\n\n\t#endif\n\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <skinning_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n\n\t#include <worldpos_vertex>\n\t#include <envmap_vertex>\n\t#include <fog_vertex>\n  \n  colorTableIndex = MODEL_INDEX;\n}\n",fragmentShader:"\nuniform vec3 diffuse;\nuniform float opacity;\n\n#ifndef FLAT_SHADED\n\n\tvarying vec3 vNormal;\n\n#endif\n\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <alphatest_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\nvarying float colorTableIndex;\nuniform vec4[INDEX] colors;\n\nvoid main() {\n\n\t#include <clipping_planes_fragment>\n\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n\n\t#include <logdepthbuf_fragment>\n\t#include <map_fragment>\n  //#include <color_fragment>\n  diffuseColor *= colors[int(colorTableIndex)];\n    \n\t#include <alphamap_fragment>\n\t#include <alphatest_fragment>\n\t#include <specularmap_fragment>\n\n\tReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n\n\t// accumulation (baked indirect lighting only)\n\t#ifdef USE_LIGHTMAP\n\n\t\tvec4 lightMapTexel = texture2D( lightMap, vLightMapUv );\n\t\treflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;\n\n\t#else\n\n\t\treflectedLight.indirectDiffuse += vec3( 1.0 );\n\n\t#endif\n\n\t// modulation\n\t#include <aomap_fragment>\n\n\treflectedLight.indirectDiffuse *= diffuseColor.rgb;\n\n\tvec3 outgoingLight = reflectedLight.indirectDiffuse;\n\n\t#include <envmap_fragment>\n\n\t#include <opaque_fragment>\n\t#include <tonemapping_fragment>\n\t#include <colorspace_fragment>\n\t#include <fog_fragment>\n\t#include <premultiplied_alpha_fragment>\n\t#include <dithering_fragment>\n\n}\n"},e.getSize()),this.colors=e,this.uniforms=g.getBasicUniforms(e.getSize()),this.transparent=!0,this.blending=n?.blending??r.bdR,this.side=n?.side??r.Wl3,e.setMaterial(this),e.updateUniformsAll()}static getBasicUniforms(e){return r.rDY.merge([r.rBU.common,r.rBU.specularmap,r.rBU.envmap,r.rBU.aomap,r.rBU.lightmap,r.rBU.fog,u.getColorUniform(e)])}}class m extends u{constructor(e,n){super({vertexShader:"\nuniform float scale;\nattribute float lineDistance;\n\nvarying float vLineDistance;\n\n#include <common>\n#include <uv_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\nattribute float MODEL_INDEX;\nvarying float colorTableIndex;\n\nvoid main() {\n\n\tvLineDistance = scale * lineDistance;\n\n\t#include <uv_vertex>\n\t#include <color_vertex>\n\t#include <morphcolor_vertex>\n\t#include <begin_vertex>\n\t#include <morphtarget_vertex>\n\t#include <project_vertex>\n\t#include <logdepthbuf_vertex>\n\t#include <clipping_planes_vertex>\n\t#include <fog_vertex>\n    \n  colorTableIndex = MODEL_INDEX;\n}\n",fragmentShader:"\nuniform vec3 diffuse;\nuniform float opacity;\n\nuniform float dashSize;\nuniform float totalSize;\n\nvarying float vLineDistance;\n\n#include <common>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\nvarying float colorTableIndex;\nuniform vec4[INDEX] colors;\n\nvoid main() {\n\n\t#include <clipping_planes_fragment>\n\n\tif ( mod( vLineDistance, totalSize ) > dashSize ) {\n\n\t\tdiscard;\n\n\t}\n\n\tvec3 outgoingLight = vec3( 0.0 );\n\tvec4 diffuseColor = vec4( diffuse, opacity );\n\n\t#include <logdepthbuf_fragment>\n\t#include <map_fragment>\n\t//#include <color_fragment>\n  diffuseColor *= colors[int(colorTableIndex)];\n    \n  outgoingLight = diffuseColor.rgb; // simple shader\n\n\t#include <opaque_fragment>\n\t#include <tonemapping_fragment>\n\t#include <colorspace_fragment>\n\t#include <fog_fragment>\n\t#include <premultiplied_alpha_fragment>\n}\n"},e.getSize()),this.colors=e,this.uniforms=m.getBasicUniforms(e.getSize()),this.depthWrite=n?.depthWrite??!0,this.transparent=!0,e.setMaterial(this),e.updateUniformsAll()}static getBasicUniforms(e){return r.rDY.merge([r.rBU.common,r.rBU.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}},u.getColorUniform(e)])}}var f=t(993);class p{constructor(e,n){this.geometries=[],this.object3D=e,this.option=n}async add(e,n,t){const o=await this.convert(e),a=n.getUniformIndex(t),l=function(e){return e.getAttribute("position").count}(o),s=new Uint16Array(l);for(let e=0;e<l;e++)s[e]=a;const c=new r.TlE(s,1);o.setAttribute(i.MODEL_INDEX,c),this.geometries.push(o)}async convert(e){return e}async merge(){0!==this.geometries.length?this.object3D.geometry=f.n4(this.geometries):this.object3D.parent?.remove(this.object3D)}}class _ extends p{async convert(e){return e.deleteAttribute("uv"),e}}class h extends p{async convert(e){return new r.TOt(e,this.option.edgeDetail)}}const v=async(e,n,t,i,o,a,l)=>{const s=.1,c=new r.DvJ(s,s,s),d=n=>n<e/2?-1:1,u=d(n)*d(t)*d(i),g=n=>3*s*(n-e/2);c.translate(g(n),g(t),g(i)),a.add([1,1,1,.2],u),l.add([1,1,1,.8],u),await(o.body?.geometryMerger.add(c,a,u)),await(o.edge?.geometryMerger.add(c,l,u))};var b=t(12),x=t(304);class y{constructor(e){this.model=e,this.isOn=!0,this.switchColor=()=>{this.isOn=!this.isOn;const e=[1,1,1,.2],n=[1,1,1,.8],t=this.model.body?.material;t.colors.changeColor(this.isOn?e:[1,0,0,.2],1),t.colors.changeColor(this.isOn?e:[0,1,0,.2],-1);const r=this.model.edge?.material;r.colors.changeColor(this.isOn?n:[1,0,0,.8],1),r.colors.changeColor(this.isOn?n:[0,1,0,.8],-1)},setInterval(this.switchColor,3e3),this.switchColor()}}window.onload=async()=>{const e=(e=>{const n=new r.xsS,t=new r.cPb(45,1280/720,1,6e4);t.position.set(0,0,15);const i=new r.CP7({antialias:!0});i.setSize(1280,720),i.setClearColor(new r.Ilk(0)),document.body.appendChild(i.domElement);const o=document.createElement("div");document.body.appendChild(o),new b.z(t,i.domElement);const a=new x.Z,l=()=>{a.begin(),i.render(n,t),a.end(),o.innerText=JSON.stringify(i.info.render),requestAnimationFrame(l)};return l(),n})(),n=await async function(e=20,n){n=n??"webgl";const t=new i({bodyOption:{color:[1,1,1,.2]},edgeOption:{color:[1,1,1,.8]}}),r=new d("colors"),o=new d("colors");return await(async(e,n,t,r)=>{const i=[];for(let o=0;o<e;o++)for(let a=0;a<e;a++)for(let l=0;l<e;l++)i.push(v(e,o,a,l,n,t,r));await Promise.all(i),await n.merge()})(e,t,r,o),((e,n,t,r)=>{e.body&&(e.body.material=new r.bodyMaterialClass(n)),e.edge&&(e.edge.material=new r.edgeMaterialClass(t))})(t,r,o,{bodyMaterialClass:g,edgeMaterialClass:m}),t}();e.add(n),new y(n)}}},t={};function r(e){var i=t[e];if(void 0!==i)return i.exports;var o=t[e]={exports:{}};return n[e](o,o.exports,r),o.exports}r.m=n,e=[],r.O=(n,t,i,o)=>{if(!t){var a=1/0;for(d=0;d<e.length;d++){for(var[t,i,o]=e[d],l=!0,s=0;s<t.length;s++)(!1&o||a>=o)&&Object.keys(r.O).every((e=>r.O[e](t[s])))?t.splice(s--,1):(l=!1,o<a&&(a=o));if(l){e.splice(d--,1);var c=i();void 0!==c&&(n=c)}}return n}o=o||0;for(var d=e.length;d>0&&e[d-1][2]>o;d--)e[d]=e[d-1];e[d]=[t,i,o]},r.d=(e,n)=>{for(var t in n)r.o(n,t)&&!r.o(e,t)&&Object.defineProperty(e,t,{enumerable:!0,get:n[t]})},r.o=(e,n)=>Object.prototype.hasOwnProperty.call(e,n),(()=>{var e={577:0};r.O.j=n=>0===e[n];var n=(n,t)=>{var i,o,[a,l,s]=t,c=0;if(a.some((n=>0!==e[n]))){for(i in l)r.o(l,i)&&(r.m[i]=l[i]);if(s)var d=s(r)}for(n&&n(t);c<a.length;c++)o=a[c],r.o(e,o)&&e[o]&&e[o][0](),e[o]=0;return r.O(d)},t=self.webpackChunk_masatomakino_colorable_merged_model=self.webpackChunk_masatomakino_colorable_merged_model||[];t.forEach(n.bind(null,0)),t.push=n.bind(null,t.push.bind(t))})();var i=r.O(void 0,[736],(()=>r(321)));i=r.O(i)})();