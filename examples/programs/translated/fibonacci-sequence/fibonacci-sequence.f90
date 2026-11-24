! Fibonacci sequence in Fortran, computed iteratively

program main
    implicit none
    integer(8) :: index

    do index = 0, 20
        print '(*(g0))', 'fibonacci(', index, ') = ', fibonacci(index)
    end do

contains

    recursive integer(8) function fibonacci(count) result(fibonacci_result)
        integer(8), value :: count
        integer(8) :: previous
        integer(8) :: current
        integer(8) :: step
        integer(8) :: next

        previous = 0
        current = 1
        do step = 0, count - 1
            next = previous + current
            previous = current
            current = next
        end do
        fibonacci_result = previous
        return
    end function fibonacci
end program main
