! Hailstone sequence in Fortran: count the steps to reach 1

program main
    implicit none
    integer(8) :: number

    do number = 1, 10
        print '(*(g0))', number, ' takes ', hailstone_steps(number), ' steps'
    end do

contains

    recursive integer(8) function hailstone_steps(number) result(hailstone_steps_result)
        integer(8), value :: number
        integer(8) :: steps

        steps = 0
        do while (number /= 1)
            if (mod(number, 2_8) == 0) then
                number = number / 2
            else
                number = 3 * number + 1
            end if
            steps = steps + 1
        end do
        hailstone_steps_result = steps
        return
    end function hailstone_steps
end program main
