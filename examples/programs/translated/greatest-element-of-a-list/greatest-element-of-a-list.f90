! Greatest element of a list in Fortran

program main
    implicit none
    integer(8), allocatable, dimension(:) :: numbers
    integer(8) :: greatest
    integer(8) :: index
    integer(8) :: number

    numbers = [17, 4, 93, 28, 65, 3, 80]
    greatest = numbers(1)
    do index = 0, size(numbers, kind=8) - 1
        number = numbers(index + 1)
        if (number > greatest) then
            greatest = number
        end if
    end do
    print '(*(g0))', 'The greatest element is ', greatest
end program main
