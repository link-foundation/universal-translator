# Mutual recursion in R: the Hofstadter Female and Male sequences

female <- function(index) {
    if (index == 0L) {
        return(1L)
    }
    return(index - male(female(index - 1L)))
}

male <- function(index) {
    if (index == 0L) {
        return(0L)
    }
    return(index - female(male(index - 1L)))
}

for (index in 0L:19L) {
    cat(index, ": ", female(index), " ", male(index), "\n", sep = "")
}
