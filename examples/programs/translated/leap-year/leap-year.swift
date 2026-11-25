// Leap year in Swift

func isLeapYear(_ year: Int) -> Bool {
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

for year in 1896..<1913 {
    if isLeapYear(year) {
        print("\(year) is a leap year")
    } else {
        print("\(year) is not a leap year")
    }
}
