! Leap year in Fortran

program main
    implicit none
    integer(8) :: year

    do year = 1896, 1912
        if (is_leap_year(year)) then
            print '(*(g0))', year, ' is a leap year'
        else
            print '(*(g0))', year, ' is not a leap year'
        end if
    end do

contains

    recursive logical function is_leap_year(year) result(is_leap_year_result)
        integer(8), value :: year

        is_leap_year_result = (mod(year, 4_8) == 0 .and. mod(year, 100_8) /= 0) .or. mod(year, 400_8) == 0
        return
    end function is_leap_year
end program main
