var total: i64 = 0;
var i: i64 = 0;
while (i <= 9) : (i += 1) {
    total += i;
}
out.print("{d}\n", .{total}) catch {};
