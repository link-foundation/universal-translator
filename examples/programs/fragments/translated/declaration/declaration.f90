integer(8) :: total
integer(8) :: i

total = 0
do i = 0, 9
    total = total + i
end do
print '(*(g0))', total
