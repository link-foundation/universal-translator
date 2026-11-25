! Sum and product of an array in Fortran

program main
    implicit none
    integer(8), allocatable, dimension(:) :: numbers
    integer(8) :: total
    integer(8) :: product
    integer(8) :: index

    numbers = [1, 2, 3, 4, 5]
    total = 0
    product = 1
    do index = 0, size(numbers, kind=8) - 1
        total = total + numbers(index + 1)
        product = product * numbers(index + 1)
    end do
    print '(*(g0))', 'Sum: ', total
    print '(*(g0))', 'Product: ', product
end program main
