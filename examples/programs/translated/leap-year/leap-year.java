// Leap year in Java

class Main {
    static boolean isLeapYear(int year) {
        return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    }

    public static void main(String[] args) {
        for (int year = 1896; year < 1913; year++) {
            if (isLeapYear(year)) {
                System.out.println("" + year + " is a leap year");
            } else {
                System.out.println("" + year + " is not a leap year");
            }
        }
    }
}
