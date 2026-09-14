import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/crypto.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding TechScreen Pro Database...');

  // Clean existing data
  await prisma.auditLog.deleteMany({});
  await prisma.emailLog.deleteMany({});
  await prisma.assessmentResult.deleteMany({});
  await prisma.candidateAnswer.deleteMany({});
  await prisma.assessmentAttempt.deleteMany({});
  await prisma.jobApplication.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.questionOption.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.assessmentSection.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.assessmentTemplate.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});

  // 1. Create Company
  const company = await prisma.company.create({
    data: {
      name: 'Acme Cloud Technologies',
      logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60',
    },
  });

  // 2. Create Users with salted password hashes
  const adminUser = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@techscreen.com',
      passwordHash: hashPassword('Admin@123456'),
      role: 'ADMIN',
      companyId: company.id,
    },
  });

  const recruiterUser = await prisma.user.create({
    data: {
      name: 'Sarah Jenkins (Lead HR)',
      email: 'recruiter@acme.com',
      passwordHash: hashPassword('Recruiter@123456'),
      role: 'RECRUITER',
      companyId: company.id,
    },
  });

  // 3. Create Assessment Templates
  // --- A. DEVOPS TEMPLATE ---
  const devopsTemplate = await prisma.assessmentTemplate.create({
    data: {
      title: 'DevOps Engineer Technical Screening',
      roleCategory: 'DEVOPS',
      companyId: company.id,
      durationMinutes: 15,
      totalQuestions: 15,
      passPercentage: 70,
      shuffleQuestions: true,
      shuffleOptions: true,
    },
  });

  // DevOps Sections & Questions
  const gitSection = await prisma.assessmentSection.create({
    data: {
      templateId: devopsTemplate.id,
      title: 'Git Version Control',
      description: 'Branching, merging, rebasing, and repository management.',
      questionCount: 5,
    },
  });

  const linuxSection = await prisma.assessmentSection.create({
    data: {
      templateId: devopsTemplate.id,
      title: 'Linux Systems Administration',
      description: 'CLI commands, file permissions, processes, and networking.',
      questionCount: 5,
    },
  });

  const dockerDevopsSection = await prisma.assessmentSection.create({
    data: {
      templateId: devopsTemplate.id,
      title: 'Docker & CI/CD Pipelines',
      description: 'Containerization, Dockerfile optimizations, and automated build flows.',
      questionCount: 5,
    },
  });

  // Git Questions
  await prisma.question.create({
    data: {
      sectionId: gitSection.id,
      prompt: 'Which command creates a new Git branch named "feature" and immediately switches to it?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'git checkout -b feature creates and checks out the new branch in one command.',
      options: {
        create: [
          { text: 'git branch feature', isCorrect: false },
          { text: 'git checkout -b feature', isCorrect: true },
          { text: 'git merge feature', isCorrect: false },
          { text: 'git switch -c --delete feature', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: gitSection.id,
      prompt: 'What is the primary difference between `git merge` and `git rebase`?',
      type: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      explanation: 'Rebase rewrites project history by moving commits onto a new base, creating a linear history.',
      options: {
        create: [
          { text: 'git merge deletes history, git rebase preserves it', isCorrect: false },
          { text: 'git rebase rewrites commit history to create a linear sequence', isCorrect: true },
          { text: 'git merge is only used for remote repositories', isCorrect: false },
          { text: 'There is no difference; they are exact aliases', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: gitSection.id,
      prompt: 'Which command allows you to temporarily shelve (store) uncommitted changes without committing them?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'git stash saves uncommitted modifications to a temporary stack.',
      options: {
        create: [
          { text: 'git hold', isCorrect: false },
          { text: 'git stash', isCorrect: true },
          { text: 'git reset --soft', isCorrect: false },
          { text: 'git save', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: gitSection.id,
      prompt: 'How do you discard changes in a working directory file `app.js` and restore it to the LAST commit?',
      type: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      explanation: 'git checkout -- app.js or git restore app.js discards local changes.',
      options: {
        create: [
          { text: 'git restore app.js', isCorrect: true },
          { text: 'git clean -df app.js', isCorrect: false },
          { text: 'git remove app.js', isCorrect: false },
          { text: 'git revert app.js', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: gitSection.id,
      prompt: 'Which Git command shows the commit hash, author, date, and commit message history?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'git log outputs commit history details.',
      options: {
        create: [
          { text: 'git status', isCorrect: false },
          { text: 'git history', isCorrect: false },
          { text: 'git log', isCorrect: true },
          { text: 'git diff', isCorrect: false },
        ],
      },
    },
  });

  // Linux Questions
  await prisma.question.create({
    data: {
      sectionId: linuxSection.id,
      prompt: 'Which numeric permission code corresponds to `rwxr-xr--` in Linux chmod syntax?',
      type: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      explanation: 'rwx = 7 (4+2+1), r-x = 5 (4+0+1), r-- = 4 (4+0+0). Total = 754.',
      options: {
        create: [
          { text: '755', isCorrect: false },
          { text: '754', isCorrect: true },
          { text: '644', isCorrect: false },
          { text: '777', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: linuxSection.id,
      prompt: 'Which command searches for the pattern "ERROR" across all `.log` files recursively in `/var/log`?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'grep -rn "ERROR" /var/log/*.log performs recursive pattern matching with line numbers.',
      options: {
        create: [
          { text: 'find /var/log -name "ERROR"', isCorrect: false },
          { text: 'grep -r "ERROR" /var/log/*.log', isCorrect: true },
          { text: 'cat /var/log | search "ERROR"', isCorrect: false },
          { text: 'locate ERROR /var/log', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: linuxSection.id,
      prompt: 'What tool is used to monitor real-time system process metrics, CPU, and memory consumption in terminal?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'htop / top gives real-time process statistics.',
      options: {
        create: [
          { text: 'top', isCorrect: true },
          { text: 'df -h', isCorrect: false },
          { text: 'free -m', isCorrect: false },
          { text: 'netstat', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: linuxSection.id,
      prompt: 'Which command checks active listening TCP ports and associated processes in Linux?',
      type: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      explanation: 'ss -tulpn or netstat -tulpn lists listening ports and PIDs.',
      options: {
        create: [
          { text: 'ss -tulpn', isCorrect: true },
          { text: 'ifconfig -a', isCorrect: false },
          { text: 'traceroute', isCorrect: false },
          { text: 'ping -l', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: linuxSection.id,
      prompt: 'How do you send a background SIGTERM signal to terminate a process with PID 4321?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'kill 4321 sends default SIGTERM (15) to PID 4321.',
      options: {
        create: [
          { text: 'kill 4321', isCorrect: true },
          { text: 'stop process 4321', isCorrect: false },
          { text: 'exit 4321', isCorrect: false },
          { text: 'taskkill /PID 4321', isCorrect: false },
        ],
      },
    },
  });

  // Docker Questions
  await prisma.question.create({
    data: {
      sectionId: dockerDevopsSection.id,
      prompt: 'Which Dockerfile instruction specifies the default command executed when a container starts?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'CMD specifies the execution defaults for a starting container.',
      options: {
        create: [
          { text: 'RUN', isCorrect: false },
          { text: 'ENV', isCorrect: false },
          { text: 'CMD', isCorrect: true },
          { text: 'EXPOSE', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: dockerDevopsSection.id,
      prompt: 'What is the purpose of multi-stage Docker builds?',
      type: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      explanation: 'Multi-stage builds allow separating build tools from final production images to keep image size minimal.',
      options: {
        create: [
          { text: 'To run multiple containers simultaneously', isCorrect: false },
          { text: 'To produce smaller production images by discarding build-time tools', isCorrect: true },
          { text: 'To bypass container security scanners', isCorrect: false },
          { text: 'To compile code without installing Docker engine', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: dockerDevopsSection.id,
      prompt: 'Which command removes all stopped containers, unused networks, and dangling images in Docker?',
      type: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      explanation: 'docker system prune cleans up unused Docker resources.',
      options: {
        create: [
          { text: 'docker system prune', isCorrect: true },
          { text: 'docker container destroy --all', isCorrect: false },
          { text: 'docker purge images', isCorrect: false },
          { text: 'docker clean --force', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: dockerDevopsSection.id,
      prompt: 'In Docker Compose, which keyword links host directory `./data` to container path `/app/data`?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'volumes mounts host paths into containers.',
      options: {
        create: [
          { text: 'ports', isCorrect: false },
          { text: 'volumes', isCorrect: true },
          { text: 'environment', isCorrect: false },
          { text: 'links', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: dockerDevopsSection.id,
      prompt: 'Select all features that characterize immutable infrastructure deployment:',
      type: 'MCQ_MULTI',
      difficulty: 'HARD',
      explanation: 'Immutable infrastructure replaces servers entirely rather than modifying them in place.',
      options: {
        create: [
          { text: 'Servers are never modified after creation; they are replaced', isCorrect: true },
          { text: 'Reduces configuration drift across environments', isCorrect: true },
          { text: 'Requires SSH into live production servers to apply hotfixes', isCorrect: false },
          { text: 'Uses versioned images/templates for automated rollbacks', isCorrect: true },
        ],
      },
    },
  });

  // --- B. FRONTEND TEMPLATE ---
  const frontendTemplate = await prisma.assessmentTemplate.create({
    data: {
      title: 'Frontend Engineer Technical Assessment',
      roleCategory: 'FRONTEND',
      companyId: company.id,
      durationMinutes: 15,
      totalQuestions: 10,
      passPercentage: 70,
    },
  });

  const jsSection = await prisma.assessmentSection.create({
    data: {
      templateId: frontendTemplate.id,
      title: 'JavaScript & Web Core',
      description: 'Promises, closures, event loop, and DOM.',
      questionCount: 5,
    },
  });

  await prisma.question.create({
    data: {
      sectionId: jsSection.id,
      prompt: 'What will `console.log(typeof NaN)` output in JavaScript?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'NaN stands for Not-a-Number, but its Javascript type is "number".',
      options: {
        create: [
          { text: '"undefined"', isCorrect: false },
          { text: '"number"', isCorrect: true },
          { text: '"nan"', isCorrect: false },
          { text: '"object"', isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      sectionId: jsSection.id,
      prompt: 'Which array method returns a NEW array containing only elements that pass a test condition?',
      type: 'MCQ_SINGLE',
      difficulty: 'EASY',
      explanation: 'Array.prototype.filter creates a shallow copy of filtered elements.',
      options: {
        create: [
          { text: 'map()', isCorrect: false },
          { text: 'forEach()', isCorrect: false },
          { text: 'filter()', isCorrect: true },
          { text: 'reduce()', isCorrect: false },
        ],
      },
    },
  });

  // 4. Create Job Openings
  const devopsJob = await prisma.job.create({
    data: {
      title: 'DevOps Engineer',
      experienceRange: '0–2 years',
      location: 'Chennai / Remote',
      skillsRequired: JSON.stringify(['Git', 'Linux', 'Docker', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD']),
      description: 'We are seeking an entry-level DevOps engineer to maintain CI/CD pipelines, manage Docker containers, and ensure cloud infrastructure reliability.',
      passThreshold: 70,
      assessmentTemplateId: devopsTemplate.id,
      companyId: company.id,
    },
  });

  const frontendJob = await prisma.job.create({
    data: {
      title: 'Frontend React Developer',
      experienceRange: '1–3 years',
      location: 'Bangalore / Remote',
      skillsRequired: JSON.stringify(['JavaScript', 'TypeScript', 'React', 'HTML5', 'CSS3', 'Tailwind']),
      description: 'Looking for a UI developer to build slick candidate and recruiter web dashboards.',
      passThreshold: 75,
      assessmentTemplateId: frontendTemplate.id,
      companyId: company.id,
    },
  });

  // 5. Create Sample Candidates & Applications
  // Candidate 1: Arun Kumar (Passed & Shortlisted)
  const candidateArun = await prisma.candidate.create({
    data: {
      name: 'Arun Kumar',
      email: 'arun.kumar@example.com',
      phone: '+91 98765 43210',
      resumeUrl: '/uploads/resumes/arun_kumar_devops.pdf',
      resumeFileName: 'arun_kumar_devops.pdf',
    },
  });

  const appArun = await prisma.jobApplication.create({
    data: {
      candidateId: candidateArun.id,
      jobId: devopsJob.id,
      status: 'HR_INTERVIEW',
      token: 'arun-devops-token-778899',
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isOtpVerified: true,
      resumeMatchScore: 92,
      resumeParsedSkills: JSON.stringify(['Git', 'Linux', 'Docker', 'Kubernetes', 'CI/CD']),
      rankingScore: 88.6,
      recommendation: 'STRONG_CANDIDATE',
    },
  });

  const codingSection = await prisma.assessmentSection.create({
    data: {
      templateId: devopsTemplate.id,
      title: 'Practical Scripting & Logic',
      description: 'Hands-on algorithm implementation and array processing.',
      questionCount: 1,
    },
  });

  await prisma.question.create({
    data: {
      sectionId: codingSection.id,
      prompt: 'Write a JavaScript function named `solution(arr)` that accepts an array of numbers and returns the sum of all POSITIVE numbers in the array. If no positive numbers exist, return 0.',
      type: 'CODING',
      difficulty: 'MEDIUM',
      explanation: 'Use Array.prototype.filter() or reduce() to sum elements > 0.',
      codeTemplate: 'function solution(arr) {\n  // Write your code here\n  return arr.filter(x => x > 0).reduce((a, b) => a + b, 0);\n}',
      testCasesJson: JSON.stringify([
        { input: '[1, -4, 7, 12]', expectedOutput: '20', description: 'Filters out negative numbers' },
        { input: '[-1, -2, -3]', expectedOutput: '0', description: 'Returns 0 for all negative numbers' },
        { input: '[5, 10, 15]', expectedOutput: '30', description: 'Sums all positive integers' },
      ]),
    },
  });

  // Mock completed attempt & result for Arun
  const attemptArun = await prisma.assessmentAttempt.create({
    data: {
      applicationId: appArun.id,
      templateId: devopsTemplate.id,
      startedAt: new Date(Date.now() - 3600000),
      submittedAt: new Date(Date.now() - 1800000),
      currentQuestionIndex: 15,
      questionOrderJson: JSON.stringify([]),
      isCompleted: true,
      integrityScore: 95,
      proctoringRiskScore: 10,
      proctoringRiskLevel: 'LOW',
      tabSwitchCount: 1,
      fullscreenViolationCount: 0,
    },
  });

  await prisma.proctoringLog.create({
    data: {
      attemptId: attemptArun.id,
      eventType: 'FOCUS_LOST',
      details: 'Browser window tab focus lost for 4 seconds.',
      timestamp: new Date(Date.now() - 2400000),
    },
  });

  await prisma.assessmentResult.create({
    data: {
      attemptId: attemptArun.id,
      totalScore: 13,
      maxScore: 15,
      percentage: 86.7,
      integrityScore: 95,
      proctoringRiskScore: 10,
      proctoringRiskLevel: 'LOW',
      rankingScore: 88.6,
      recommendation: 'STRONG_CANDIDATE',
      codingScore: 10,
      codingMaxScore: 10,
      sectionScoresJson: JSON.stringify({
        'Git Version Control': { score: 5, max: 5 },
        'Linux Systems Administration': { score: 4, max: 5 },
        'Docker & CI/CD Pipelines': { score: 4, max: 5 },
        'Practical Scripting & Logic': { score: 10, max: 10 },
      }),
      isPassed: true,
    },
  });

  // Candidate 2: Priya Sharma (Invited & Pending)
  const candidatePriya = await prisma.candidate.create({
    data: {
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+91 91234 56789',
      resumeUrl: '/uploads/resumes/priya_sharma_resume.pdf',
      resumeFileName: 'priya_sharma_resume.pdf',
    },
  });

  await prisma.jobApplication.create({
    data: {
      candidateId: candidatePriya.id,
      jobId: devopsJob.id,
      status: 'INVITED',
      token: 'demo-test-token-priya-123456',
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isOtpVerified: false,
      resumeMatchScore: 88,
      resumeParsedSkills: JSON.stringify(['Git', 'Linux', 'Docker', 'AWS']),
    },
  });

  // Candidate 3: David Joseph (High Score 84% but High Proctoring Risk 78% -> MANUAL_REVIEW)
  const candidateDavid = await prisma.candidate.create({
    data: {
      name: 'David Joseph',
      email: 'david.joseph@example.com',
      phone: '+91 97777 88899',
      resumeUrl: '/uploads/resumes/david_joseph_devops.pdf',
      resumeFileName: 'david_joseph_devops.pdf',
    },
  });

  const appDavid = await prisma.jobApplication.create({
    data: {
      candidateId: candidateDavid.id,
      jobId: devopsJob.id,
      status: 'MANUAL_REVIEW',
      token: 'david-test-token-889900',
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isOtpVerified: true,
      resumeMatchScore: 94,
      resumeParsedSkills: JSON.stringify(['Git', 'Linux', 'Docker', 'Kubernetes', 'AWS', 'Terraform']),
      rankingScore: 78.6,
      recommendation: 'MANUAL_REVIEW',
    },
  });

  const attemptDavid = await prisma.assessmentAttempt.create({
    data: {
      applicationId: appDavid.id,
      templateId: devopsTemplate.id,
      startedAt: new Date(Date.now() - 5400000),
      submittedAt: new Date(Date.now() - 3600000),
      currentQuestionIndex: 15,
      questionOrderJson: JSON.stringify([]),
      isCompleted: true,
      integrityScore: 22,
      proctoringRiskScore: 78,
      proctoringRiskLevel: 'HIGH',
      tabSwitchCount: 5,
      fullscreenViolationCount: 2,
      screenShareStopCount: 1,
    },
  });

  await prisma.proctoringLog.createMany({
    data: [
      { attemptId: attemptDavid.id, eventType: 'FOCUS_LOST', details: 'Browser tab switched away (duration 18s)', timestamp: new Date(Date.now() - 5000000) },
      { attemptId: attemptDavid.id, eventType: 'FOCUS_LOST', details: 'Browser tab switched away (duration 24s)', timestamp: new Date(Date.now() - 4700000) },
      { attemptId: attemptDavid.id, eventType: 'FULLSCREEN_EXIT', details: 'Candidate exited fullscreen mode', timestamp: new Date(Date.now() - 4500000) },
      { attemptId: attemptDavid.id, eventType: 'SCREEN_SHARE_STOPPED', details: 'Screen sharing stream was halted by candidate', timestamp: new Date(Date.now() - 4200000) },
      { attemptId: attemptDavid.id, eventType: 'FOCUS_LOST', details: 'Window blur event recorded', timestamp: new Date(Date.now() - 4000000) },
      { attemptId: attemptDavid.id, eventType: 'FULLSCREEN_EXIT', details: 'Candidate exited fullscreen mode again', timestamp: new Date(Date.now() - 3800000) },
    ],
  });

  await prisma.assessmentResult.create({
    data: {
      attemptId: attemptDavid.id,
      totalScore: 12.6,
      maxScore: 15,
      percentage: 84.0,
      integrityScore: 22,
      proctoringRiskScore: 78,
      proctoringRiskLevel: 'HIGH',
      rankingScore: 78.6,
      recommendation: 'MANUAL_REVIEW',
      sectionScoresJson: JSON.stringify({
        'Git Version Control': { score: 4, max: 5 },
        'Linux Systems Administration': { score: 4, max: 5 },
        'Docker & CI/CD Pipelines': { score: 4, max: 5 },
      }),
      isPassed: true,
    },
  });

  // Candidate 4: Rahul Verma (Failed Assessment)
  const candidateRahul = await prisma.candidate.create({
    data: {
      name: 'Rahul Verma',
      email: 'rahul.verma@example.com',
      phone: '+91 98111 22233',
      resumeUrl: '/uploads/resumes/rahul_verma_cv.pdf',
      resumeFileName: 'rahul_verma_cv.pdf',
    },
  });

  const appRahul = await prisma.jobApplication.create({
    data: {
      candidateId: candidateRahul.id,
      jobId: devopsJob.id,
      status: 'REJECTED',
      token: 'rahul-test-token-445566',
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isOtpVerified: true,
      resumeMatchScore: 65,
      rankingScore: 51.5,
      recommendation: 'REJECT',
    },
  });

  const attemptRahul = await prisma.assessmentAttempt.create({
    data: {
      applicationId: appRahul.id,
      templateId: devopsTemplate.id,
      startedAt: new Date(Date.now() - 7200000),
      submittedAt: new Date(Date.now() - 5400000),
      currentQuestionIndex: 15,
      questionOrderJson: JSON.stringify([]),
      isCompleted: true,
      integrityScore: 60,
      proctoringRiskScore: 40,
      proctoringRiskLevel: 'MEDIUM',
      tabSwitchCount: 4,
      fullscreenViolationCount: 2,
    },
  });

  await prisma.proctoringLog.createMany({
    data: [
      { attemptId: attemptRahul.id, eventType: 'FOCUS_LOST', details: 'Browser tab switched away (duration 12s)', timestamp: new Date(Date.now() - 6800000) },
      { attemptId: attemptRahul.id, eventType: 'FULLSCREEN_EXIT', details: 'Candidate exited fullscreen mode', timestamp: new Date(Date.now() - 6500000) },
      { attemptId: attemptRahul.id, eventType: 'COPY_PASTE', details: 'Attempted right-click / paste inside question body', timestamp: new Date(Date.now() - 6100000) },
      { attemptId: attemptRahul.id, eventType: 'FOCUS_LOST', details: 'Window focus lost (duration 45s)', timestamp: new Date(Date.now() - 5800000) },
    ],
  });

  await prisma.assessmentResult.create({
    data: {
      attemptId: attemptRahul.id,
      totalScore: 8,
      maxScore: 15,
      percentage: 53.3,
      integrityScore: 60,
      proctoringRiskScore: 40,
      proctoringRiskLevel: 'MEDIUM',
      rankingScore: 51.5,
      recommendation: 'REJECT',
      sectionScoresJson: JSON.stringify({
        'Git Version Control': { score: 3, max: 5 },
        'Linux Systems Administration': { score: 3, max: 5 },
        'Docker & CI/CD Pipelines': { score: 2, max: 5 },
      }),
      isPassed: false,
    },
  });

  // Candidate 5: Ananya Roy (Fresh Test - Not Started)
  const candidateAnanya = await prisma.candidate.create({
    data: {
      name: 'Ananya Roy',
      email: 'ananya.roy@example.com',
      phone: '+91 98450 11223',
      resumeUrl: '/uploads/resumes/ananya_roy_resume.pdf',
      resumeFileName: 'ananya_roy_resume.pdf',
    },
  });

  await prisma.jobApplication.create({
    data: {
      candidateId: candidateAnanya.id,
      jobId: devopsJob.id,
      status: 'INVITED',
      token: 'cand-ejd0a2vdf-mtn7f6sj',
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isOtpVerified: false,
      resumeMatchScore: 85,
      resumeParsedSkills: JSON.stringify(['Git', 'Linux', 'Docker', 'CI/CD']),
    },
  });

  // Candidate 6: Vikram Singh (Fresh Test - Not Started)
  const candidateVikram = await prisma.candidate.create({
    data: {
      name: 'Vikram Singh',
      email: 'vikram.singh@example.com',
      phone: '+91 99000 44332',
      resumeUrl: '/uploads/resumes/vikram_singh_resume.pdf',
      resumeFileName: 'vikram_singh_resume.pdf',
    },
  });

  await prisma.jobApplication.create({
    data: {
      candidateId: candidateVikram.id,
      jobId: devopsJob.id,
      status: 'INVITED',
      token: 'cand-syvu4v225-mtn7f6tl',
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isOtpVerified: false,
      resumeMatchScore: 80,
      resumeParsedSkills: JSON.stringify(['Linux', 'Docker', 'Kubernetes']),
    },
  });

  // Audit Logs
  await prisma.auditLog.create({
    data: {
      userId: recruiterUser.id,
      userName: recruiterUser.name,
      action: 'JOB_CREATED',
      entity: 'Job',
      details: 'Created job DevOps Engineer with 70% pass threshold.',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: recruiterUser.id,
      userName: recruiterUser.name,
      action: 'CANDIDATE_SHORTLISTED',
      entity: 'JobApplication',
      details: 'Moved candidate Arun Kumar to HR Interview stage.',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: recruiterUser.id,
      userName: recruiterUser.name,
      action: 'CANDIDATE_FLAGGED_REVIEW',
      entity: 'JobApplication',
      details: 'Candidate David Joseph scored 84% but flagged for MANUAL REVIEW due to High Proctoring Risk (78 pts).',
    },
  });

  console.log('✅ Database Seeding Completed Successfully!');
  console.log('----------------------------------------------------');
  console.log('Demo Candidates & Test Links:');
  console.log('1. Priya Sharma (Pending Test): http://localhost:3000/assessment/demo-test-token-priya-123456');
  console.log('2. Arun Kumar (Completed & Passed): Recruiter Dashboard view ready');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
