// 99 bottles of beer in Swift

var bottles = 99
while bottles > 0 {
    print("\(bottles) bottles of beer on the wall, \(bottles) bottles of beer.")
    print("Take one down and pass it around, \(bottles - 1) bottles of beer on the wall.")
    bottles -= 1
}
