#!/usr/bin/env bash
# Sum and product of an array in Bash

numbers=(1 2 3 4 5)
total=0
product=1
for (( index = 0; index < ${#numbers[@]}; index++ )); do
    total=$((total + numbers[index]))
    product=$((product * numbers[index]))
done
echo "Sum: $total"
echo "Product: $product"
