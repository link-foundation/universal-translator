! Primality by trial division in Fortran

program main
    implicit none
    integer(8) :: number

    do number = 1, 50
        if (is_prime(number)) then
            print '(*(g0))', number
        end if
    end do

contains

    recursive logical function is_prime(number) result(is_prime_result)
        integer(8), value :: number
        integer(8) :: divisor

        if (number < 2) then
            is_prime_result = .false.
            return
        end if
        divisor = 2
        do while (divisor * divisor <= number)
            if (mod(number, divisor) == 0) then
                is_prime_result = .false.
                return
            end if
            divisor = divisor + 1
        end do
        is_prime_result = .true.
        return
    end function is_prime
end program main
