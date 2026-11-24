# Towers of Hanoi in R, solved recursively

move_disks <- function(count, source, target, spare) {
    if (count == 0L) {
        return(invisible())
    }
    move_disks(count - 1L, source, spare, target)
    cat("Move disk ", count, " from ", source, " to ", target, "\n", sep = "")
    move_disks(count - 1L, spare, target, source)
}

move_disks(4L, 1L, 3L, 2L)
