! Bubble sort in Fortran: sort a list of numbers

program main
    implicit none
    integer(8), allocatable, dimension(:) :: numbers
    integer(8) :: count
    integer(8) :: pass
    integer(8) :: index
    integer(8) :: swap
    integer(8) :: position

    numbers = [5, 3, 8, 1, 9, 2, 7]
    count = size(numbers, kind=8)
    do pass = 0, count - 1 - 1
        do index = 0, count - 1 - pass - 1
            if (numbers(index + 1) > numbers(index + 2)) then
                swap = numbers(index + 1)
                numbers(index + 1) = numbers(index + 2)
                numbers(index + 2) = swap
            end if
        end do
    end do
    do position = 0, count - 1
        print '(*(g0))', numbers(position + 1)
    end do
end program main
