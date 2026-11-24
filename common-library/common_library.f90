! Standard-output operations of the common library for Fortran.
module common_library
    implicit none

contains

    subroutine print_line(text)
        character(len=*), intent(in) :: text

        print '(a)', text
    end subroutine print_line

    subroutine write_text(text)
        character(len=*), intent(in) :: text

        write (*, '(a)', advance='no') text
    end subroutine write_text

    subroutine write_integer(integer)
        integer(8), value :: integer

        write (*, '(i0)', advance='no') integer
    end subroutine write_integer

    subroutine end_line()
        print '(a)', ''
    end subroutine end_line
end module common_library
