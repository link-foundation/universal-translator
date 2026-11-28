! число

program main
    implicit none

    ! итеративно
    print '(*(g0))', twice(5_8)

contains

    ! последовательность
    recursive integer(8) function twice(n) result(twice_result)
        integer(8), value :: n

        twice_result = n * 2
        return
    end function twice
end program main
