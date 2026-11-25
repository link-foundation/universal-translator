let total : Z := 0 in
total <- for_range 0 10 (fun i total =>
  let total := total + i in
  pure total) total ;;
print_line (show total) ;;
