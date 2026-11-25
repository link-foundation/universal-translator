! Ackermann procedure in Fortran, defined recursively

program main
    implicit none
    integer(8) :: first
    integer(8) :: second

    do first = 0, 3
        do second = 0, 4
            print '(*(g0))', 'ackermann(', first, ', ', second, ') = ', ackermann(first, second)
        end do
    end do

contains

    recursive integer(8) function ackermann(first, second) result(ackermann_result)
        integer(8), value :: first
        integer(8), value :: second

        if (first == 0) then
            ackermann_result = second + 1
            return
        end if
        if (second == 0) then
            ackermann_result = ackermann(first - 1, 1_8)
            return
        end if
        ackermann_result = ackermann(first - 1, ackermann(first, second - 1))
        return
    end function ackermann
end program main
