import psycopg2
from db import get_db_connection, transaction

def run_test():
    print("connection test")
    con = get_db_connection()
    print("connected:", con is not None)

    cur = con.cursor()
    cur.execute("SELECT 1;")
    print("SELECT ok:", cur.fetchone())

    print("INSERT test")
    cur.execute("CREATE TABLE IF NOT EXISTS sanity_test(id serial PRIMARY KEY, v text);")
    cur.execute("INSERT INTO sanity_test(v) VALUES(%s) RETURNING id;", ("abc",))
    inserted_id = cur.fetchone()[0]
    print("inserted id:", inserted_id)

    print("query test")
    cur.execute("SELECT v FROM sanity_test WHERE id=%s;", (inserted_id,))
    print("value:", cur.fetchone()[0])

    # close cursor
    cur.close()

    # commit schema change and insert
    con.commit()

    print("transaction test")
    with transaction() as tx:
        tx.execute("UPDATE sanity_test SET v=%s WHERE id=%s;", ("zzz", inserted_id))

    # verify result on fresh cursor
    cur = con.cursor()
    cur.execute("SELECT v FROM sanity_test WHERE id=%s;", (inserted_id,))
    print("after update:", cur.fetchone()[0])

    cur.close()
    con.close()

if __name__ == "__main__":
    run_test()
