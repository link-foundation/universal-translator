recursive integer(8) function square(value_) result(square_result)
    integer(8), value :: value_

    square_result = value_ * value_
    return
end function square
