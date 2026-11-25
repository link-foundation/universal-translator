# 99 bottles of beer in R

bottles <- 99L
while (bottles > 0L) {
    cat(bottles, " bottles of beer on the wall, ", bottles, " bottles of beer.\n", sep = "")
    cat("Take one down and pass it around, ", bottles - 1L, " bottles of beer on the wall.\n", sep = "")
    bottles <- bottles - 1L
}
