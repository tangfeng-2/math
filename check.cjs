// Run: node check.cjs — dependency-free checks for rendering, sizing and quiz content.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
const element = selector => {
  if (!elements.has(selector)) elements.set(selector, {
    innerHTML: '', textContent: '', disabled: false,
    querySelectorAll: () => [], classList: { toggle() {} },
  });
  return elements.get(selector);
};
const context = vm.createContext({
  document: { querySelector: element, querySelectorAll: () => [], addEventListener() {} },
  cancelAnimationFrame() {}, requestAnimationFrame() { return 1; }, performance: { now: () => 0 },
});
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
vm.runInContext(html.match(/<script>([\s\S]*)<\/script>/)[1], context);
for (let page = 0; page < 7; page++) {
  vm.runInContext(`start(${page})`, context);
  assert.ok(element('#title').textContent);
  assert.ok(element('#canvas').innerHTML);
  assert.ok(element('#aside').innerHTML);
}
for (const radius of [1, 2.5, 4]) {
  vm.runInContext(`start(4); $('#radius').oninput({target:{value:${radius}}})`, context);
  assert.equal(element('#dval').textContent, `d = ${(radius * 2).toFixed(1)} cm`);
  assert.match(element('#canvas').innerHTML, new RegExp(`r="${radius * 45}"`));
}
vm.runInContext('start(3); drawing=1; paint()', context);
assert.match(element('#canvas').innerHTML, /stroke-dashoffset="0"/);
const answers = vm.runInContext('questions.map(q=>q.a[q.ok]).join("|")', context);
assert.equal(answers, '位置|6 厘米|都相等|无数条|4 厘米');
vm.runInContext('start(5)', context);
assert.equal(element('#nextQ').disabled, true);


// Exercise the actual drawing handlers with SVG-coordinate pointer events.
const board = element('#lineBoard');
Object.assign(board, {
  focus() {}, setPointerCapture() {}, releasePointerCapture() {}, setAttribute() {},
  createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return {x:this.x,y:this.y}; } }; },
  getScreenCTM() { return { inverse() { return {}; } }; },
});
element('#lineCursor').setAttribute = () => {};
const run = code => vm.runInContext(code, context);
const pointer = (x,y,id=1) => ({clientX:x,clientY:y,button:0,pointerId:id,preventDefault(){}});
run('start(6)');
assert.equal(element('#next').disabled, true);
assert.equal(run('lineLength({a:{x:365,y:220},b:snapLinePoint({x:530,y:220})})'), 5);
assert.equal(run('snapLinePoint({x:370,y:223}).x'), 365);
assert.equal(run('snapLinePoint({x:999,y:220}).x'), 535);
board.onpointerdown(pointer(369,224));
board.onpointermove(pointer(530,220));
board.onpointerup(pointer(530,220));
assert.equal(run('segments.length'),1);
assert.equal(run('lineLength(segments[0])'),5);
board.onpointerdown(pointer(195,220));
board.onpointerup(pointer(535,220));
assert.equal(run('lineLength(segments[1])'),10);
board.onpointerdown(pointer(365,220));
assert.equal(run('draft'),null);
assert.equal(run('segments.length'),2);
element('#undoLine').onclick();
assert.equal(run('segments.length'),1);
board.onpointerdown(pointer(400,220));
board.onpointercancel();
assert.equal(run('segments.length'),1);
assert.equal(run('draft'),null);
element('#clearLines').onclick();
assert.equal(run('segments.length'),0);
board.onpointerdown(pointer(365,220));
board.onpointerup(pointer(365,220));
assert.equal(run('segments.length'),0); // A tap must not create a zero-length line.
board.onpointerdown(pointer(0,0));
assert.equal(run('draft'),null); // Reject starts outside the circle.
board.onpointerdown(pointer(365,220));
board.onpointermove(pointer(535,220,2));
assert.equal(run('lineLength(draft)'),0); // Ignore a second touch.
element('#clearLines').onclick();
board.onpointerup(pointer(535,220)); // Clearing during a gesture must not throw.
const key = key => board.onkeydown({key,preventDefault(){}});
key('Enter');
for(let i=0;i<34;i++)key('ArrowRight');
key('Enter');
assert.equal(run('lineLength(segments[0])'),5);
run('start(0); start(6)');
assert.equal(run('segments.length'),0);
console.log('PASS: seven sections; radius/diameter; quiz; drawing snap, length, limit, undo, clear, cancellation, multitouch and keyboard');
