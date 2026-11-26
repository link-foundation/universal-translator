int main(int argc, char** argv)
{
    try {
        int i = 0;
        throw 8;
    }
    catch (int e)
    {
        return e;
    }
    return 0;
}
