! Perfect numbers in Fortran: numbers equal to the sum of their divisors

program main
    implicit none
    integer(8) :: number

    do number = 1, 10000
        if (is_perfect(number)) then
            print '(*(g0))', number
        end if
    end do

contains

    recursive logical function is_perfect(number) result(is_perfect_result)
        integer(8), value :: number
        integer(8) :: sum
        integer(8) :: divisor

        sum = 1
        divisor = 2
        do while (divisor * divisor <= number)
            if (mod(number, divisor) == 0) then
                sum = sum + divisor
                if (divisor * divisor /= number) then
                    sum = sum + number / divisor
                end if
            end if
            divisor = divisor + 1
        end do
        is_perfect_result = number > 1 .and. sum == number
        return
    end function is_perfect
end program main
