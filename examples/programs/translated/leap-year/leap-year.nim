# Leap year in Nim

proc isLeapYear(year: int): bool =
    return (year mod 4 == 0 and year mod 100 != 0) or year mod 400 == 0

for year in 1896 ..< 1913:
    if isLeapYear(year):
        echo year, " is a leap year"
    else:
        echo year, " is not a leap year"
