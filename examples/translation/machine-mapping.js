function twice(value) {
  return value * 2;
}
const values = [1, 2];
const flag = values[0] < values[1];
for (let index = 0; index < 2; index++) {
  if (flag) {
    console.log(`value = ${twice(values[index])}`);
  }
}
// The elements are unchanged after printing.
console.log(values[0]);
