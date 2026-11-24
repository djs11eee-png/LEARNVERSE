export const heapSource = `class MinQueue {
  constructor() {
    this.items = [];
    this.ticket = 0;
  }

  get size() { return this.items.length; }

  earlier(a, b) {
    return a.distance < b.distance || (a.distance === b.distance && a.order < b.order);
  }

  push(id, distance) {
    const row = { id, distance, order: this.ticket++ };
    const items = this.items;
    items.push(row);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.earlier(items[index], items[parent])) break;
      items[index] = items[parent];
      items[parent] = row;
      index = parent;
    }
  }

  pop() {
    const items = this.items;
    if (items.length === 0) return null;
    const first = items[0];
    const last = items.pop();
    if (items.length === 0) return first;
    items[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= items.length) break;
      const right = left + 1;
      let child = left;
      if (right < items.length && this.earlier(items[right], items[left])) child = right;
      if (!this.earlier(items[child], items[index])) break;
      items[index] = items[child];
      items[child] = last;
      index = child;
    }
    return first;
  }
}`

export const relaxSource = `for (const edge of graph.get(current.id)) {
      const candidate = current.distance + edge.weight;
      const known = distances.get(edge.to);
      if (known !== undefined && candidate >= known) continue;
      distances.set(edge.to, candidate);
      parents.set(edge.to, current.id);
      pending.push(edge.to, candidate);
    }`

export const dijkstraTemplate = `function dijkstra(graph, start, goal) {
  const distances = new Map([[start, 0]]);
  const parents = new Map([[start, null]]);
  const pending = new MinQueue();
  pending.push(start, 0);
  while (pending.size > 0) {
    const current = pending.pop();
    if (current.distance !== distances.get(current.id)) continue;
    if (current.id === goal) {
      return { distance: current.distance, path: pathFrom(parents, goal) };
    }
    /* 更新找到的更短路径 */
  }
  return null;
}`

export const dijkstraSource = dijkstraTemplate.replace('/* 更新找到的更短路径 */', relaxSource)

