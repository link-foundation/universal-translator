! Towers of Hanoi in Fortran, solved recursively

program main
    implicit none

    call move_disks(4_8, 1_8, 3_8, 2_8)

contains

    recursive subroutine move_disks(count, source, target, spare)
        integer(8), value :: count
        integer(8), value :: source
        integer(8), value :: target
        integer(8), value :: spare

        if (count == 0) then
            return
        end if
        call move_disks(count - 1, source, spare, target)
        print '(*(g0))', 'Move disk ', count, ' from ', source, ' to ', target
        call move_disks(count - 1, spare, target, source)
    end subroutine move_disks
end program main
