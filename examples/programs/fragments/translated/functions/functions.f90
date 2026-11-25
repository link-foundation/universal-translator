recursive integer(8) function sum_of_squares(limit) result(sum_of_squares_result)
    integer(8), value :: limit
    integer(8) :: total
    integer(8) :: i

    total = 0
    do i = 1, limit
        total = total + square(i)
    end do
    sum_of_squares_result = total
    return
end function sum_of_squares

recursive integer(8) function square(value_) result(square_result)
    integer(8), value :: value_

    square_result = value_ * value_
    return
end function square
