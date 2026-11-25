! 99 bottles of beer in Fortran

program main
    implicit none
    integer(8) :: bottles

    bottles = 99
    do while (bottles > 0)
        print '(*(g0))', bottles, ' bottles of beer on the wall, ', bottles, ' bottles of beer.'
        print '(*(g0))', 'Take one down and pass it around, ', bottles - 1, ' bottles of beer on the wall.'
        bottles = bottles - 1
    end do
end program main
