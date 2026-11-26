! Sum multiples of 3 and 5 in Fortran: the sum of the multiples below 1000

program main
    implicit none
    integer(8) :: total
    integer(8) :: number

    total = 0
    do number = 1, 999
        if (mod(number, 3_8) == 0 .or. mod(number, 5_8) == 0) then
            total = total + number
        end if
    end do
    print '(*(g0))', total
end program main
