! Greatest common divisor in Fortran, using the Euclidean algorithm

program main
    implicit none

    print '(*(g0))', 'The greatest common divisor of 1071 and 462 is ', greatest_common_divisor(1071_8, 462_8)

contains

    recursive integer(8) function greatest_common_divisor(first, second) result(greatest_common_divisor_result)
        integer(8), value :: first
        integer(8), value :: second
        integer(8) :: remainder

        do while (second /= 0)
            remainder = mod(first, second)
            first = second
            second = remainder
        end do
        greatest_common_divisor_result = first
        return
    end function greatest_common_divisor
end program main
