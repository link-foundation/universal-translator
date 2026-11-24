// Leap year in JavaScript

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

for (let year = 1896; year < 1913; year++) {
    if (isLeapYear(year)) {
        console.log(`${year} is a leap year`);
    } else {
        console.log(`${year} is not a leap year`);
    }
}
