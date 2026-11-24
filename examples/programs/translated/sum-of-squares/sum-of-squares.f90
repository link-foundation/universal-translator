! Sum of squares in Fortran

program main
    implicit none
    integer(8) :: limit

    limit = 10
    print '(*(g0))', 'Sum of squares from 1 to ', limit, ':'
    print '(*(g0))', sum_of_squares(limit)

contains

    recursive integer(8) function sum_of_squares(limit) result(sum_of_squares_result)
        integer(8), value :: limit
        integer(8) :: total
        integer(8) :: number

        total = 0
        number = 1
        do while (number <= limit)
            total = total + number * number
            number = number + 1
        end do
        sum_of_squares_result = total
        return
    end function sum_of_squares
end program main
