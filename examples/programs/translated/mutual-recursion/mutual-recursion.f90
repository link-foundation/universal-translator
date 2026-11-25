! Mutual recursion in Fortran: the Hofstadter Female and Male sequences

program main
    implicit none
    integer(8) :: index

    do index = 0, 19
        print '(*(g0))', index, ': ', female(index), ' ', male(index)
    end do

contains

    recursive integer(8) function female(index) result(female_result)
        integer(8), value :: index

        if (index == 0) then
            female_result = 1
            return
        end if
        female_result = index - male(female(index - 1))
        return
    end function female

    recursive integer(8) function male(index) result(male_result)
        integer(8), value :: index

        if (index == 0) then
            male_result = 0
            return
        end if
        male_result = index - female(male(index - 1))
        return
    end function male
end program main
