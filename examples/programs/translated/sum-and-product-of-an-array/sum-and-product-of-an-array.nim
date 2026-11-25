# Sum and product of an array in Nim

let numbers = @[1, 2, 3, 4, 5]
var total = 0
var product = 1
for index in 0 ..< numbers.len:
    total += numbers[index]
    product *= numbers[index]
echo "Sum: ", total
echo "Product: ", product
