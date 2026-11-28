// Independently implemented Objpak String/Set iteration policy: signed UTF-8
// bytes XORed into 32 bits, linear probing, 16 slots, growth before insertion
// above half occupancy, and iteration in slot order. See the case study sources.
// An identifier absent from the user's tree names each helper.
export const objpakRuntime = {
  objc: `id $SET$(int count, char **values, int includeProgram) {
    id arguments = [OrdCltn new];
    int index = 0;
    if (!includeProgram) index = 1;
    while (index < count) {
        [arguments add:[String str:values[index]]];
        index++;
    }
    return arguments;
}
`,
  javascript: `class $SET$ {
  constructor() { this.slots = new Array(16).fill(null); this.count = 0; }
  hash(value) {
    let hash = 0;
    const bytes = new TextEncoder().encode(value);
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i] < 128 ? bytes[i] : bytes[i] - 256;
      hash = (hash ^ (byte << ((i % 4) * 8))) >>> 0;
    }
    return hash;
  }
  place(value) {
    let slot = this.hash(value) % this.slots.length;
    while (this.slots[slot] !== null && this.slots[slot] !== value) {
      slot = (slot + 1) % this.slots.length;
    }
    if (this.slots[slot] === null) { this.slots[slot] = value; this.count++; }
    return this;
  }
  add(value) {
    if (2 * this.count > this.slots.length) {
      const previous = this.slots;
      this.slots = new Array(2 * previous.length + 1).fill(null);
      this.count = 0;
      for (const item of previous) { if (item !== null) { this.place(item); } }
    }
    return this.place(value);
  }
  *[Symbol.iterator]() { for (let index = 0; index < this.slots.length; index++) { const item = this.slots[index]; if (item !== null) { yield item; } } }
}
`,
  python: `class $SET$:
    def __init__(self):
        self.slots = [None] * 16
        self.count = 0

    def _hash(self, value):
        result = 0
        for index, byte in enumerate(value.encode('utf-8')):
            signed = byte if byte < 128 else byte - 256
            result = (result ^ (signed << ((index % 4) * 8))) & 0xffffffff
        return result

    def _place(self, value):
        slot = self._hash(value) % len(self.slots)
        while self.slots[slot] is not None and self.slots[slot] != value:
            slot = (slot + 1) % len(self.slots)
        if self.slots[slot] is None:
            self.slots[slot] = value
            self.count += 1
        return self

    def add(self, value):
        if 2 * self.count > len(self.slots):
            previous = self.slots
            self.slots = [None] * (2 * len(previous) + 1)
            self.count = 0
            for item in previous:
                if item is not None:
                    self._place(item)
        return self._place(value)

    def __iter__(self):
        index = 0
        while index < len(self.slots):
            item = self.slots[index]
            index += 1
            if item is not None:
                yield item
`,
  rust: `#[derive(Clone)]
struct $SET$ { state: std::rc::Rc<std::cell::RefCell<$SET$State>> }
struct $SET$State { slots: Vec<Option<String>>, count: usize }
struct $SET$Iterator { set: $SET$, offset: usize }
impl $SET$State {
    fn hash(value: &str) -> u32 {
        value.bytes().enumerate().fold(0, |hash, (i, byte)| {
            hash ^ ((byte as i8 as u32).wrapping_shl(((i % 4) * 8) as u32))
        })
    }
    fn place(&mut self, value: String) {
        let mut slot = Self::hash(&value) as usize % self.slots.len();
        while self.slots[slot].is_some() && self.slots[slot].as_ref() != Some(&value) {
            slot = (slot + 1) % self.slots.len();
        }
        if self.slots[slot].is_none() { self.slots[slot] = Some(value); self.count += 1; }
    }
    fn add(&mut self, value: String) {
        if 2 * self.count > self.slots.len() {
            let capacity = 2 * self.slots.len() + 1;
            let previous = std::mem::replace(&mut self.slots, vec![None; capacity]);
            self.count = 0;
            for item in previous.into_iter().flatten() { self.place(item); }
        }
        self.place(value);
    }
}
impl $SET$ {
    fn new() -> Self { Self { state: std::rc::Rc::new(std::cell::RefCell::new($SET$State { slots: vec![None; 16], count: 0 })) } }
    fn add(&self, value: String) -> Self { self.state.borrow_mut().add(value); self.clone() }
    fn iter(&self) -> $SET$Iterator { $SET$Iterator { set: self.clone(), offset: 0 } }
}
impl Iterator for $SET$Iterator {
    type Item = String;
    fn next(&mut self) -> Option<String> {
        let state = self.set.state.borrow();
        while self.offset < state.slots.len() {
            let item = state.slots[self.offset].clone();
            self.offset += 1;
            if item.is_some() { return item; }
        }
        None
    }
}
`,
};
