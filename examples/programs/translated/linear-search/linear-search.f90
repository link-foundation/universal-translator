! Linear search in Fortran: find the position of a value in a list

program main
    implicit none
    integer(8), allocatable, dimension(:) :: numbers
    integer(8) :: wanted
    integer(8) :: position
    integer(8) :: current
    integer(8) :: index
    integer(8) :: number

    numbers = [31, 41, 59, 26, 53, 58, 97, 93]
    wanted = 53
    position = -1
    current = 0
    do index = 0, size(numbers, kind=8) - 1
        number = numbers(index + 1)
        if (number == wanted .and. position < 0) then
            position = current
        end if
        current = current + 1
    end do
    print '(*(g0))', 'Found ', wanted, ' at position ', position
end program main
