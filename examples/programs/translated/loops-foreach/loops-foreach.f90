! Loops/Foreach in Fortran: print every element of a collection

program main
    implicit none
    integer(8), allocatable, dimension(:) :: numbers
    integer(8) :: index
    integer(8) :: number

    numbers = [1, 1, 2, 3, 5, 8, 13, 21]
    do index = 0, size(numbers, kind=8) - 1
        number = numbers(index + 1)
        print '(*(g0))', number
    end do
end program main
