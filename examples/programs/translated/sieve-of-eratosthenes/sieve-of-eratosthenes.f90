! Sieve of Eratosthenes in Fortran: the primes up to 100

program main
    implicit none
    integer(8) :: limit
    integer(8), allocatable, dimension(:) :: is_prime
    integer(8) :: number
    integer(8) :: multiple

    limit = 100
    is_prime = spread(1, 1, limit + 1)
    is_prime(1) = 0
    is_prime(2) = 0
    do number = 2, limit
        if (is_prime(number + 1) == 1) then
            print '(*(g0))', number
            multiple = number * number
            do while (multiple <= limit)
                is_prime(multiple + 1) = 0
                multiple = multiple + number
            end do
        end if
    end do
end program main
