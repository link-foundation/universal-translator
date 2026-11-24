! Sum digits of an integer in Fortran

program main
    implicit none

    print '(*(g0))', 'The digits of 1234567890 sum to ', sum_of_digits(1234567890_8)

contains

    recursive integer(8) function sum_of_digits(number) result(sum_of_digits_result)
        integer(8), value :: number
        integer(8) :: total

        total = 0
        do while (number > 0)
            total = total + mod(number, 10_8)
            number = number / 10
        end do
        sum_of_digits_result = total
        return
    end function sum_of_digits
end program main
