// server/seeds/140_doctors_realistic_names.js
const bcrypt = require('bcryptjs');

const specializations = [
  'General Practice',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Psychiatry',
  'Orthopedics',
  'Neurology'
];

// 7 specializations x 20 = 140 names
// Each array contains 20 realistic but fictional Indian-style names
const names = {
  'General Practice': [
    'Aarav Mehra','Isha Kapoor','Rohan Desai','Ananya Rao','Vikram Nair',
    'Priya Sharma','Karan Malhotra','Neha Gupta','Siddharth Iyer','Tanya Verma',
    'Aditya Joshi','Simran Kaur','Raghav Bhat','Pooja Menon','Sachin Patel',
    'Meera Srinivasan','Arjun Reddy','Shruti Shah','Varun Chawla','Anita D’Souza'
  ],
  'Cardiology': [
    'Arjun Malhotra','Ritika Basu','Devansh Mehta','Nisha Chaudhary','Kunal Reddy',
    'Sneha Nair','Ramesh Iyer','Bhavika Patel','Tarun Kapoor','Suman Rao',
    'Prateek Verma','Geeta Srinivas','Amitabh Shah','Namita Joshi','Vivek Khanna',
    'Shreya Anand','Nikhil Bhat','Lata Menon','Harshad Desai','Maya Kulkarni'
  ],
  'Dermatology': [
    'Kavya Rao','Arvind Sharma','Deepa Nair','Rohit Gupta','Anjali Reddy',
    'Manish Patel','Sonia Mehra','Ishaan Verma','Mitali Joshi','Vikash Shah',
    'Rekha Singh','Tarika Menon','Naveen Kumar','Neelam Desai','Arpita Chatterjee',
    'Yash Kothari','Rhea Bhatia','Pranav Iyer','Zoya Khan','Karan Mehta'
  ],
  'Pediatrics': [
    'Smita Rao','Adil Khan','Kiran Patel','Pallavi Joshi','Rajat Sharma',
    'Naina Gupta','Sujit Rao','Lalita Nair','Gaurav Mehta','Dia Kapoor',
    'Amit Sharma','Rhea Sen','Vikas Desai','Maya Reddy','Sana Verma',
    'Ishita Bhat','Dev Mehra','Sonal Shah','Ritesh Iyer','Megha Kulkarni'
  ],
  'Psychiatry': [
    'Ritu Kapoor','Anil Menon','Veena Sharma','Arjun Singh','Nisha Bhatia',
    'Sahil Verma','Sangeeta Rao','Rakesh Iyer','Pooja Desai','Vivek Gupta',
    'Mansi Joshi','Harinder Kaur','Sumanth Reddy','Kavita Patel','Rohit Sen',
    'Neeta Shah','Ajay Kumar','Tanvi Mehra','Karan Nair','Priyanka Bose'
  ],
  'Orthopedics': [
    'Vikram Joshi','Nitin Patel','Ankita Rao','Raman Singh','Karuna Menon',
    'Arvind Nair','Jyoti Gupta','Rakesh Sharma','Navin Desai','Ritu Kapoor',
    'Suresh Iyer','Mehul Shah','Smita Verma','Hardeep Kaur','Rohit Malhotra',
    'Manju Srinivasan','Parth Bhat','Leena Reddy','Vishal Mehta','Kajal Deshpande'
  ],
  'Neurology': [
    'Naveen Rao','Sakshi Sharma','Ashwin Patel','Richa Mehta','Mohan Iyer',
    'Sonal Bhat','Rupesh Verma','Manisha Joshi','Tarun Nair','Neeraj Gupta',
    'Ritika Singh','Aakash Shah','Devika Rao','Sandeep Menon','Ila Desai',
    'Kunal Rao','Priya Sen','Ramesh Kulkarni','Shreya Nayar','Arjun Bedi'
  ]
};

function randomPhone() {
  // simple Indian-like phone generator
  const prefixes = ['9','8','7'];
  let s = prefixes[Math.floor(Math.random()*prefixes.length)];
  for (let i=0;i<9;i++) s += Math.floor(Math.random()*10);
  return s;
}

function randInt(min, max) {
  return Math.floor(Math.random()*(max-min+1))+min;
}

exports.seed = async function(knex) {
  // this seed creates doctor users + doctor rows
  try {
    // 1) Create users array
    const usersToInsert = [];
    const doctorRowsToInsert = [];
    const commonPasswordHash = bcrypt.hashSync('Doctor@123', 10); // simple default password

    let counter = 1;

    for (const spec of specializations) {
      const specNames = names[spec];
      for (let i = 0; i < specNames.length; i++) {
        const full = specNames[i];
        // split into first + last (if single word, use 'Doctor')
        const parts = full.split(' ');
        const first = parts[0];
        const last = parts.length > 1 ? parts.slice(1).join(' ') : 'Doctor';

        // generate email unique
        const email = `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g,'')}${counter}@telemed.local`;

        usersToInsert.push({
          id: knex.raw('gen_random_uuid()'), // let db generate uuid
          first_name: first,
          last_name: last,
          email: email,
          phone: randomPhone(),
          password_hash: commonPasswordHash,
          role: 'doctor',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        });

        counter++;
      }
    }

    // Insert users and get returned ids in same order
    const insertedUsers = await knex('users')
      .insert(usersToInsert)
      .returning(['id', 'first_name', 'last_name']);

    // insertedUsers is an array of rows including id, first_name, last_name
    // Now create doctors rows mapping to insertedUsers in same order
    let idx = 0;
    counter = 1;
    for (const spec of specializations) {
      const specNames = names[spec];
      for (let i = 0; i < specNames.length; i++) {
        const usr = insertedUsers[idx];
        const [first, ...rest] = specNames[i].split(' ');
        const last = rest.length ? rest.join(' ') : 'Doctor';

        // build doctor row
        const license = `LIC-${spec.slice(0,3).toUpperCase()}-${String(counter).padStart(4,'0')}`;
        const bio = `${first} ${last} is an experienced ${spec.toLowerCase()} specialising in patient-centered care.`;
        const fees = randInt(300, 1500);
        const exp = randInt(3, 25);
        const education = JSON.stringify(['MBBS', spec === 'Pediatrics' ? 'DCH' : (spec === 'Cardiology' ? 'DM Cardio' : 'MD')]);
        const certifications = JSON.stringify([]);
        const languages = JSON.stringify(['English', 'Hindi']);
        const availability = JSON.stringify({ mon: '10-4', tue: '10-4', wed: '10-4' });

        doctorRowsToInsert.push({
          id: knex.raw('gen_random_uuid()'),
          user_id: usr.id,
          license_number: license,
          specialization: spec,
          bio,
          consultation_fee: fees,
          experience_years: exp,
          education,
          certifications,
          languages,
          availability,
          is_available: true,
          rating: (Math.round((4.2 + Math.random()*0.7)*10)/10), // 4.2 - 4.9
          total_reviews: randInt(10, 400),
          created_at: new Date(),
          updated_at: new Date()
        });

        idx++;
        counter++;
      }
    }

    // Insert doctors
    await knex('doctors').insert(doctorRowsToInsert);

    console.log('✅ Seed finished: inserted users and doctors (fictional realistic names).');

  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  }
};
