# Standard-output operations of the common library for R.

print_line <- function(text) cat(text, "\n", sep = "")

write_text <- function(text) cat(text, sep = "")

write_integer <- function(integer) cat(format(integer, scientific = FALSE), sep = "")

end_line <- function() cat("\n")
