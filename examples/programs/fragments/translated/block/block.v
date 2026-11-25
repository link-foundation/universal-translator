x <- (if x >? 0 then
  print_line "positive" ;;
  pure x
else
  let x := 0 in
  pure x) ;;
