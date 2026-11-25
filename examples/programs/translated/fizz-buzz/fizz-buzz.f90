! FizzBuzz in Fortran

program main
    implicit none
    integer(8) :: number

    do number = 1, 100
        if (mod(number, 15_8) == 0) then
            print '(*(g0))', 'FizzBuzz'
        else if (mod(number, 3_8) == 0) then
            print '(*(g0))', 'Fizz'
        else if (mod(number, 5_8) == 0) then
            print '(*(g0))', 'Buzz'
        else
            print '(*(g0))', number
        end if
    end do
end program main
