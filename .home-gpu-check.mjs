import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import {createServer} from 'vite'
const server = await createServer({server:{port:4292,host:'127.0.0.1',strictPort:true}})
await server.listen()
const browser = await chromium.launch().catch(()=>chromium.launch({channel:'msedge'}))
try {
  const origin='http://127.0.0.1:4292'
  const page=await browser.newPage({reducedMotion:'reduce',viewport:{width:1440,height:900}})
  const errors=[]; page.on('pageerror', e=>errors.push(e.message))
  await page.goto(origin)
  const btn = page.locator('.earth-globe')
  await btn.focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForFunction(()=>document.querySelector('.earth-globe canvas')?.style.opacity==='1')
  const cv=btn.locator('canvas')
  const angle=()=>cv.evaluate(el=>{
    const gl=el.getContext('webgl2')
    if(!gl) return null
    return gl.getUniform(gl.getParameter(gl.CURRENT_PROGRAM),gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM),'longitude'))
  })
  assert.ok(await angle() > 1.6,'Shader is linked and drew the initial turn')
  await page.keyboard.press('Home')
  await page.waitForTimeout(150)
  assert.ok(Math.abs(await angle() - 78*Math.PI/180)<.001)
  await btn.evaluate(el=>el.blur())
  await page.screenshot({path:'.home-gpu-image.png'})
  await cv.evaluate(el=>el.style.visibility='hidden')
  await page.screenshot({path:'.home-static-image.png'})
  await cv.evaluate(el=>el.style.removeProperty('visibility'))
  await page.emulateMedia({reducedMotion:'no-preference'})
  const box=await btn.boundingBox()
  const x=box.x+box.width*.5, y=box.y+box.height*.46
  await page.mouse.move(x,y); await page.mouse.down()
  await page.mouse.move(x+90,y,{steps:8}); await page.mouse.up()
  const moved = await angle(); await page.waitForTimeout(140)
  assert.notEqual(await angle(),moved,'GPU keeps turning on release')
  const magnets=page.locator('.magnet-zone')
  assert.equal(await magnets.count(),2)
  for(const i of [0,1]) {
    const area=await magnets.nth(i).boundingBox()
    await page.mouse.move(area.x+9,area.y+12); await page.waitForTimeout(150)
    assert.ok(Math.abs(parseFloat(await magnets.nth(i).evaluate(el=>el.style.getPropertyValue('--magnet-x'))))>1)
  }
  await cv.evaluate(el=>el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
  await page.waitForFunction(()=>{const c=document.querySelector('.earth-globe canvas'); return c?.width<=240 && c.style.opacity==='1'})
  const softwareSample=()=>cv.evaluate(c=>c.getContext('2d').getImageData(c.width/2,c.height/2,20,1).data.join(','))
  await btn.focus()
  const lost=await softwareSample()
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(160)
  assert.notEqual(await softwareSample(),lost)
  const fallback=await browser.newPage({reducedMotion:'reduce',viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest) {return type==='webgl2'?null:original.call(this,type,...rest)}})
  await fallback.goto(origin)
  await fallback.locator('.earth-globe').tap({position:{x:195,y:80}})
  await fallback.waitForFunction(()=>{const c=document.querySelector('.earth-globe canvas'); return c?.width<=240 && c.style.opacity==='1'})
  assert.deepEqual(errors,[])
  console.log('PASS GPU shader, reset, inertia, both magnets, context loss, WebGL-disabled touch fallback.')
} finally {await browser.close(); await server.close()}
