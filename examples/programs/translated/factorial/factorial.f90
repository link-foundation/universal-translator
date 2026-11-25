! Factorial in Fortran, defined recursively

program main
    implicit none
    integer(8) :: number

    do number = 0, 10
        print '(*(g0))', number, '! = ', factorial(number)
    end do

contains

    recursive integer(8) function factorial(number) result(factorial_result)
        integer(8), value :: number

        if (number <= 1) then
            factorial_result = 1
            return
        end if
        factorial_result = number * factorial(number - 1)
        return
    end function factorial
end program main
