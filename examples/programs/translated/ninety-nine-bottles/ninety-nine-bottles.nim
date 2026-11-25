# 99 bottles of beer in Nim

var bottles = 99
while bottles > 0:
    echo bottles, " bottles of beer on the wall, ", bottles, " bottles of beer."
    echo "Take one down and pass it around, ", bottles - 1, " bottles of beer on the wall."
    bottles -= 1
